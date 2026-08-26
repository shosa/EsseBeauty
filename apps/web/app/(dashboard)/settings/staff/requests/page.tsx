import { redirect } from "next/navigation";

export default function StaffRequestsRedirect() {
  redirect("/staff/permissions");
}
