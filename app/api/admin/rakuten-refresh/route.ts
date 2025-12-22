// app/api/admin/rakuten-refresh/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const NPX_CMD = process.platform === "win32" ? "npx.cmd" : "npx";
const TSX_CLI = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.cjs");

type CommandResult = {
  ok: boolean;
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout?: string;
  stderr?: string;
  ms: number;
};

async function runCommand(opts: {
  cmd: string;
  args: string[];
  timeoutMs: number;
}): Promise<CommandResult> {
  const start = Date.now();

  try {
    const { stdout, stderr } = await execFileAsync(opts.cmd, opts.args, {
      timeout: opts.timeoutMs,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      ok: true,
      code: 0,
      signal: null,
      stdout,
      stderr,
      ms: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      code: typeof err?.code === "number" ? err.code : 1,
      signal: err?.signal ?? null,
      stdout: err?.stdout,
      stderr: err?.stderr ?? err?.message,
      ms: Date.now() - start,
    };
  }
}

/**
 * POST — used by cron + admin dashboard
 */
export async function POST(req: Request) {
  // 🔐 Optional cron protection
  if (process.env.CRON_SECRET) {
    const key = req.headers.get("x-cron-key");
    if (key !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  const { searchParams } = new URL(req.url);

  const timeoutMs = Math.max(
    60_000,
    Math.min(20 * 60_000, Number(searchParams.get("timeoutMs") ?? 10 * 60_000))
  );

  const useLocalTsx = existsSync(TSX_CLI);
  const result = await runCommand({
    cmd: useLocalTsx ? process.execPath : NPX_CMD,
    args: useLocalTsx ? [TSX_CLI, "scripts/sync-rakuten.ts"] : ["tsx", "scripts/sync-rakuten.ts"],
    timeoutMs,
  });

  if (!result.ok) {
    console.error("[RAKUTEN_REFRESH_FAILED]", {
      code: result.code,
      signal: result.signal,
      ms: result.ms,
      stderr: result.stderr,
    });

    return NextResponse.json(
      {
        ok: false,
        message: "Rakuten sync failed",
        code: result.code,
        signal: result.signal,
        ms: result.ms,
        stderr: result.stderr,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Rakuten sync completed",
    ms: result.ms,
    // helpful for debugging in Vercel logs
    stdout: result.stdout,
    stderr: result.stderr,
  });
}

/**
 * GET — convenience for manual trigger (still protected if CRON_SECRET is set)
 */
export async function GET(req: Request) {
  return POST(req);
}
