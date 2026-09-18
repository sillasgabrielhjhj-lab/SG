import { Button } from '@/components/ui/button'

function Hero() {
  return (
    <section
      id="home"
      className="relative z-10 flex flex-col items-center text-center px-6 pt-32 pb-40 py-[90px]"
    >
      <h1
        className="animate-fade-rise text-5xl sm:text-7xl md:text-8xl leading-[0.95] tracking-[-2.46px] max-w-7xl font-normal text-foreground"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        Onde <em className="not-italic text-muted-foreground">ideias</em>{' '}
        ganham vida{' '}
        <em className="not-italic text-muted-foreground">
          através do código.
        </em>
      </h1>

      <p className="animate-fade-rise-delay text-muted-foreground text-base sm:text-lg max-w-2xl mt-8 leading-relaxed">
        Crio sites e experiências digitais sob medida para marcas que querem
        se destacar. Do conceito ao código, cada projeto nasce com precisão e
        propósito.
      </p>

      <Button
        variant="glass"
        size="pill"
        className="animate-fade-rise-delay-2 px-14 py-5 text-base h-auto mt-12 cursor-pointer"
      >
        Iniciar Projeto
      </Button>
    </section>
  )
}

export default Hero
