import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ImageSlider } from "@/components/ui/image-slider";
import gradPodium from "@/images/pexels-kaypics-27945940.jpg";
import gradSpeech from "@/images/IMG_3522.jpg";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl lg:min-h-[640px] lg:grid-cols-2">
        <div className="relative hidden lg:block">
          <ImageSlider images={[gradPodium, gradSpeech]} interval={4500} />
        </div>

        <div className="flex flex-col justify-center p-8 md:p-12">
          <Link
            href="/"
            className="mb-8 inline-block w-fit text-xl font-semibold tracking-tight text-kick-blue"
          >
            KickScholar
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
