"use client";

import React from "react";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Divider,
  Link,
  Image,
} from "@heroui/react";
import { login } from "@/actions/auth";
import Logo from "@/assets/Logo2.jpg";

const page = () => {
  return (
    <div className="mt-5 flex justify-center gap-4">
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
            <p className="text-md">NextPGP</p>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-center">
            Secure your world with immersive encryption.
          </p>
        </CardBody>
        <Button className="mt-4 p-6" onPress={() => login("google")}>
          <svg width={24} height="1.5em" viewBox="0 0 24 25">
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
      </Card>
    </div>
  );
};

export default page;
