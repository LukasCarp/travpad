import { Suspense } from "react";
import TravPadHome from "@/components/TravPadHome";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TravPadHome />
    </Suspense>
  );
}
