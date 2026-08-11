"use client";

import { Button, Card, CardHeader, CardBody, Image } from "@heroui/react";
import { login } from "@/actions/auth";
import ConnectivityCheck from "@/components/connectivity-check";
import Logo from "@/assets/Logo2.jpg";
import { GoogleIcon, GitHubIcon, DiscordIcon } from "@/components/icons";
import { useEffect } from "react";

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
