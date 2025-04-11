"use client";

import { useEffect, useState } from "react";
import { Card, Skeleton } from "@heroui/react";

const UserDetails = () => {
  const [session, setSession] = useState(null);

  useEffect(() => {
    const fetchSession = async () => {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      setSession(data);
    };
    fetchSession();
  }, []);

  if (!session) {
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
    <div>
      <h1 className="text-center text-2xl dm-serif-text-regular mb-3">
        {session?.user.name}
      </h1>
      {session?.user.image && (
        <img
          className="rounded-medium"
          width={150}
          src={session.user.image}
        />
      )}
    </div>
  );
};

export default UserDetails;