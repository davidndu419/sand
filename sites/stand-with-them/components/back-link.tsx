"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackLink({
  fallbackHref,
  label,
  confirmMessage,
}: {
  fallbackHref: string;
  label: string;
  confirmMessage?: string;
}) {
  const router = useRouter();

  function navigateBack(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
      return;
    }

    let cameFromThisSite = false;
    try {
      cameFromThisSite = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    } catch {
      cameFromThisSite = false;
    }

    if (cameFromThisSite && window.history.length > 1) {
      event.preventDefault();
      router.back();
    }
  }

  return <Link className="back-link" href={fallbackHref} onClick={navigateBack}><ArrowLeft size={16} aria-hidden="true" />{label}</Link>;
}
