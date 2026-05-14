import { redirect } from "next/navigation";

// Legacy deep-link route. The profile is now an overlay over the map, driven
// by ?profile=<id>. Redirect anyone landing here to the new URL.
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?profile=${id}`);
}
