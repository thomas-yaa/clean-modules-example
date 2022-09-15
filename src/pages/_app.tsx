// third party
import { useEffect } from "react";
import { useRouter } from "next/router";
import type { AppProps } from "next/app";


function MyApp(_: AppProps) {
  const { route } = useRouter();

  useEffect(() => {
  }, [route]);

  return (
    <div>Hello</div>
  );
}

export default MyApp;
