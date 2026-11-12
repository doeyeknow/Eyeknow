import { Suspense } from "react";
import SubscriptionLanding from "@/components/SubscriptionLanding";

export default function SubscriptionPage() {
  return (
    <Suspense>
      <SubscriptionLanding />
    </Suspense>
  );
}
