"use client";

import { useEffect } from "react";
import { sendGAEvent } from "@next/third-parties/google";

const InitialLoadActiveUsers = () => {
  useEffect(() => {
    sendGAEvent({ event: "cookieDomain", value: "none" });
  }, []);

  return null;
};

export default InitialLoadActiveUsers;
