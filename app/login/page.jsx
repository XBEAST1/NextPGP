"use client";

import { Button, Card, CardHeader, CardBody, Image } from "@heroui/react";
import { login } from "@/actions/auth";
import ConnectivityCheck from "@/components/connectivity-check";
import Logo from "@/assets/Logo2.jpg";
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
          <svg width={24} height="2em" viewBox="0 0 24 25">
            <path
              d="M21.8055 11.0076H21V10.9661H12V14.9661H17.6515C16.827 17.2946 14.6115 18.9661 12 18.9661C8.6865 18.9661 6 16.2796 6 12.9661C6 9.65256 8.6865 6.96606 12 6.96606C13.5295 6.96606 14.921 7.54306 15.9805 8.48556L18.809 5.65706C17.023 3.99256 14.634 2.96606 12 2.96606C6.4775 2.96606 2 7.44356 2 12.9661C2 18.4886 6.4775 22.9661 12 22.9661C17.5225 22.9661 22 18.4886 22 12.9661C22 12.2956 21.931 11.6411 21.8055 11.0076Z"
              fill="#FFC107"
            />
            <path
              d="M3.15234 8.31156L6.43784 10.7211C7.32684 8.52006 9.47984 6.96606 11.9993 6.96606C13.5288 6.96606 14.9203 7.54306 15.9798 8.48556L18.8083 5.65706C17.0223 3.99256 14.6333 2.96606 11.9993 2.96606C8.15834 2.96606 4.82734 5.13456 3.15234 8.31156Z"
              fill="#FF3D00"
            />
            <path
              d="M12.0002 22.9664C14.5832 22.9664 16.9302 21.9779 18.7047 20.3704L15.6097 17.7514C14.5719 18.5406 13.3039 18.9674 12.0002 18.9664C9.39916 18.9664 7.19066 17.3079 6.35866 14.9934L3.09766 17.5059C4.75266 20.7444 8.11366 22.9664 12.0002 22.9664Z"
              fill="#4CAF50"
            />
            <path
              d="M21.8055 11.0076H21V10.9661H12V14.9661H17.6515C17.2571 16.0743 16.5467 17.0427 15.608 17.7516L15.6095 17.7506L18.7045 20.3696C18.4855 20.5686 22 17.9661 22 12.9661C22 12.2956 21.931 11.6411 21.8055 11.0076Z"
              fill="#1976D2"
            />
          </svg>
          Continue With Google
        </Button>
        <Button className="mt-4 p-6" onPress={() => login("github")}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            x="0px"
            y="0px"
            width="100"
            height="100"
            viewBox="0 0 30 30"
          >
            <path d="M15,3C8.373,3,3,8.373,3,15c0,5.623,3.872,10.328,9.092,11.63C12.036,26.468,12,26.28,12,26.047v-2.051 c-0.487,0-1.303,0-1.508,0c-0.821,0-1.551-0.353-1.905-1.009c-0.393-0.729-0.461-1.844-1.435-2.526 c-0.289-0.227-0.069-0.486,0.264-0.451c0.615,0.174,1.125,0.596,1.605,1.222c0.478,0.627,0.703,0.769,1.596,0.769 c0.433,0,1.081-0.025,1.691-0.121c0.328-0.833,0.895-1.6,1.588-1.962c-3.996-0.411-5.903-2.399-5.903-5.098 c0-1.162,0.495-2.286,1.336-3.233C9.053,10.647,8.706,8.73,9.435,8c1.798,0,2.885,1.166,3.146,1.481C13.477,9.174,14.461,9,15.495,9 c1.036,0,2.024,0.174,2.922,0.483C18.675,9.17,19.763,8,21.565,8c0.732,0.731,0.381,2.656,0.102,3.594 c0.836,0.945,1.328,2.066,1.328,3.226c0,2.697-1.904,4.684-5.894,5.097C18.199,20.49,19,22.1,19,23.313v2.734 c0,0.104-0.023,0.179-0.035,0.268C23.641,24.676,27,20.236,27,15C27,8.373,21.627,3,15,3z"></path>
          </svg>
          Continue With Github
        </Button>
      </Card>
    </div>
  );
};

export default Page;
