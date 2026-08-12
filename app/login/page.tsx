"use client";

import { Button, Card, CardHeader, CardBody, Image, addToast } from "@heroui/react";
import { login } from "@/actions/auth";
import ConnectivityCheck from "@/components/connectivity-check";
import Logo from "@/assets/Logo2.jpg";
import { GoogleIcon, GitHubIcon, DiscordIcon } from "@/components/icons";
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

function LoginErrorToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      if (error === "UnverifiedEmail") {
        addToast({
          title: "Account Linking Blocked",
          description:
            "Unverified email account linking attempt blocked. Please verify your email with the provider first.",
          color: "danger",
        });
      } else if (error === "OAuthAccountNotLinked" || error === "AccessDenied") {
        addToast({
          title: "Sign-in Failed",
          description:
            "Access was denied or this email is already associated with another provider.",
          color: "danger",
        });
      } else {
        addToast({
          title: "Authentication Error",
          description: "An error occurred during sign-in. Please try again.",
          color: "danger",
        });
      }

      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("error");
      const newUrl = newParams.toString()
        ? `${pathname}?${newParams.toString()}`
        : pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router, pathname]);

  return null;
}

const Page = () => {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/vault")
    ) {
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("forceReload", Date.now().toString());
        window.location.replace(url.toString());
      }, 500);
    }
  }, []);

  return (
    <div className="mt-20 flex justify-center gap-4">
      <Suspense fallback={null}>
        <LoginErrorToast />
      </Suspense>
      <ConnectivityCheck />
      <Card className="w-[500px] p-4">
        <CardHeader className="flex justify-center gap-3">
          <Image
            alt="heroui logo"
            height={40}
            radius="sm"
            src={Logo.src}
            width={40}
          />
          <div className="flex flex-col">
            <p className="text-md">Next PGP</p>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-center">
            Secure your world with immersive encryption.
          </p>
        </CardBody>
        <Button className="mt-4 p-6" onPress={() => login("google")}>
          <GoogleIcon size={27} />
          Continue With Google
        </Button>
        <Button className="mt-4 p-6" onPress={() => login("github")}>
          <GitHubIcon size={30} />
          Continue With Github
        </Button>
        <Button className="mt-4 p-6" onPress={() => login("discord")}>
          <DiscordIcon size={30} />
          Continue With Discord
        </Button>
      </Card>
    </div>
  );
};

export default Page;
