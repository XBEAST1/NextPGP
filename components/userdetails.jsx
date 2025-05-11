"use client";

import { useEffect, useState } from "react";
import { Card, Skeleton } from "@heroui/react";

const UserDetails = () => {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        setSession(data);
      } catch (error) {
        console.error("Failed to fetch session:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSession();
  }, []);

  if (isLoading) {
    return (
      <Card className="w-[145px] h-[173px] space-y-5 p-4" radius="lg">
        <div className="space-y-3">
          <Skeleton className="w-full rounded-lg">
            <div className="h-8 w-full rounded-lg bg-default-300" />
          </Skeleton>
        </div>
        <Skeleton className="rounded-lg">
          <div className="h-28 rounded-lg bg-default-300" />
        </Skeleton>
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-center text-2xl dm-serif-text-regular mb-3">
        {session?.user?.name}
      </h1>
      {session?.user?.image && (
        <img
          alt="User Avatar"
          className="rounded-medium"
          width={150}
          height={150}
          src={session.user.image}
        />
      )}
    </div>
  );
};

export default UserDetails;
