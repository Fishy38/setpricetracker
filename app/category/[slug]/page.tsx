// app/category/[slug]/page.tsx
import HomeClient from "@/app/home-client";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const resolved = await params;
  const slug = resolved?.slug;

  return <HomeClient initialCategory={slug} />;
}