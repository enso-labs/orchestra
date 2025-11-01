const MacbookMock: React.FC = () => {
  return (
    <div
      className="relative mx-auto"
      style={{
        width: "350px",
        height: "690px",
        backgroundImage:
          'url("https://static-cse.canva.com/_next/static/assets/device_w1200xh710_c8f97490d9901a8f86232832e4ae6f9bc637e914f91c49f92068b35f44481729.png")',
        backgroundPosition: "center",
        backgroundSize: "350px 690px",
        backgroundRepeat: "no-repeat",
      }}
    >
      <video
        className="absolute"
        src="https://agent.commit.dev/landing-page-video.352a9d12.mp4#t=0.1"
        loop
        playsInline
        preload="auto"
        autoPlay
        muted
        style={{
          left: "26px",
          top: "23px",
          width: "298px",
          height: "643px",
          borderRadius: "40px",
          objectFit: "fill",
        }}
      ></video>
    </div>
  );
};

export default MacbookMock;
