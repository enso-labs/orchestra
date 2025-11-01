const videoUrl = "https://dmpl4rwnofmx.cloudfront.net/Demo_Video.mp4";

const IphoneMock: React.FC = () => {
    return (
      <div
        className="relative mx-auto translate-x-1/2 lg:translate-x-0 lg:mx-0"
        style={{
          width: "350px",
          height: "690px",
          backgroundImage:
            'url("/images/iphone-mock.png")',
          backgroundPosition: "center",
          backgroundSize: "350px 690px",
          backgroundRepeat: "no-repeat",
          right: "0"
        }}
      >
        <div className="absolute" style={{
          left: "26px",
          top: "23px",
          width: "298px",
          height: "643px",
          borderRadius: "40px",
          backgroundColor: "rgba(0,0,0,0.3)",
          zIndex: 1
        }}></div>
        <video
          className="absolute"
          src={videoUrl}
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
}

export default IphoneMock