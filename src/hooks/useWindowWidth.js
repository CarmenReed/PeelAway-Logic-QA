import { useState, useEffect } from "react";

export default function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    let timer;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setWidth(window.innerWidth), 150);
    };
    window.addEventListener("resize", handler);
    return () => { window.removeEventListener("resize", handler); clearTimeout(timer); };
  }, []);
  return width;
}
