import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4'

function App() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>

      <Navbar />
      <Hero />
    </div>
  )
}

export default App
