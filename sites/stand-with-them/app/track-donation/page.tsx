import { redirect } from "next/navigation";

export default function TrackDonationPage() {
  redirect("/verify-receipt");
}
