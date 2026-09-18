import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'

const navLinks = [
  { label: 'Início', href: '#home', active: true },
  { label: 'Portfólio', href: '#portfolio' },
  { label: 'Sobre', href: '#about' },
  { label: 'Blog', href: '#blog' },
  { label: 'Contato', href: '#contact' },
]

function Navbar() {
  return (
    <nav className="relative z-10 flex flex-row items-center justify-between px-8 py-6 max-w-7xl mx-auto">
      <Logo />

      <div className="hidden md:flex items-center gap-8">
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className={
              link.active
                ? 'text-sm text-foreground transition-colors'
                : 'text-sm text-muted-foreground hover:text-foreground transition-colors'
            }
          >
            {link.label}
          </a>
        ))}
      </div>

      <Button
        variant="glass"
        size="pill"
        className="px-6 py-2.5 text-sm h-auto"
      >
        Iniciar Projeto
      </Button>
    </nav>
  )
}

export default Navbar
