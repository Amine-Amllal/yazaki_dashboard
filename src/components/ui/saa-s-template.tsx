"use client";

import React from "react";
import { ArrowRight, Menu, X, FileText, Shield, BarChart3, Zap, Globe, MessageCircle } from "lucide-react";
import Link from "next/link";
import { GLSLHills } from "./glsl-hills";

// Inline Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "gradient";
  size?: "default" | "sm" | "lg";
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className = "", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      default: "bg-white text-[#231F20] hover:bg-gray-100",
      secondary: "bg-[#231F20] text-white hover:bg-[#3d3839]",
      ghost: "hover:bg-white/10 text-white",
      gradient: "bg-gradient-to-b from-[#E60012] via-[#E60012] to-[#b8000e] text-white hover:scale-105 active:scale-95 shadow-lg shadow-[#E60012]/30"
    };

    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-10 px-5 text-sm",
      lg: "h-12 px-8 text-base"
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

// Scroll-reveal hook
function useInView(options?: { threshold?: number; once?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (options?.once !== false) observer.unobserve(el);
        } else if (options?.once === false) {
          setIsInView(false);
        }
      },
      { threshold: options?.threshold ?? 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [options?.threshold, options?.once]);

  return { ref, isInView };
}

// AnimateOnScroll wrapper
interface AnimateProps {
  children: React.ReactNode;
  animation?: "fade-up" | "fade-down" | "fade-left" | "fade-right" | "scale" | "fade";
  delay?: number;
  duration?: number;
  className?: string;
}

const AnimateOnScroll = ({ children, animation = "fade-up", delay = 0, duration = 0.7, className = "" }: AnimateProps) => {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  const transforms: Record<string, string> = {
    "fade-up": "translateY(40px)",
    "fade-down": "translateY(-40px)",
    "fade-left": "translateX(-40px)",
    "fade-right": "translateX(40px)",
    "scale": "scale(0.9)",
    "fade": "none",
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? "none" : transforms[animation],
        transition: `opacity ${duration}s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform ${duration}s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
};

// Navigation Component
const Navigation = React.memo(() => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-[#1a1617]/90 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/yazaki-icon.svg"
              alt="Yazaki"
              style={{ width: 32, height: 'auto' }}
            />
            <span className="text-lg font-semibold text-white tracking-tight">YAZAKI</span>
          </div>

          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">
              Features
            </a>
            <a href="#workflow" className="text-sm text-white/60 hover:text-white transition-colors">
              Process
            </a>
            <a href="#stats" className="text-sm text-white/60 hover:text-white transition-colors">
              Statistics
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login">
              <Button type="button" variant="gradient" size="sm">
                Sign in
              </Button>
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-[#1a1617]/95 backdrop-blur-md border-t border-white/10 animate-[slideDown_0.3s_ease-out]">
          <div className="px-6 py-4 flex flex-col gap-4">
            <a
              href="#features"
              className="text-sm text-white/60 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </a>
            <a
              href="#workflow"
              className="text-sm text-white/60 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Process
            </a>
            <a
              href="#stats"
              className="text-sm text-white/60 hover:text-white transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Statistics
            </a>
            <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
              <Link href="/login">
                <Button type="button" variant="gradient" size="sm" className="w-full">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

Navigation.displayName = "Navigation";

// Hero Component
const Hero = React.memo(() => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-start px-6 pt-28 md:pt-32 pb-20 overflow-hidden">
      <style>{`
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroScale {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .hero-stagger-1 { animation: heroFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
        .hero-stagger-2 { animation: heroFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.25s both; }
        .hero-stagger-3 { animation: heroFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both; }
        .hero-stagger-4 { animation: heroFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.55s both; }
        .hero-stagger-5 { animation: heroScale 1s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both; }
      `}</style>

      {/* GLSL Hills 3D background */}
      <div className="absolute inset-0 z-0 pointer-events-none" style={{ maxHeight: "80vh" }}>
        <GLSLHills width="100%" height="100%" cameraZ={125} speed={0.5} />
      </div>

      <aside className="hero-stagger-1 mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border border-[#E60012]/30 bg-[#E60012]/10 backdrop-blur-sm max-w-full relative z-10">
        <span className="text-xs text-center whitespace-nowrap text-[#E60012]">
          Yazaki Technical Change Management
        </span>
        <a
          href="#features"
          className="flex items-center gap-1 text-xs text-[#E60012] hover:text-white transition-all active:scale-95 whitespace-nowrap"
          aria-label="Learn more about the features"
        >
          Learn more
          <ArrowRight size={12} />
        </a>
      </aside>

      <h1
        className="hero-stagger-2 text-4xl md:text-5xl lg:text-6xl font-bold text-center max-w-4xl px-6 leading-tight mb-6 relative z-10"
        style={{
          background: "linear-gradient(to bottom, #ffffff, #ffffff, rgba(255, 255, 255, 0.6))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          letterSpacing: "-0.04em"
        }}
      >
        Optimize your <br />
        <span
          style={{
            background: "linear-gradient(135deg, #E60012, #ff3344)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Technical Changes
        </span>
      </h1>

      <p className="hero-stagger-3 text-sm md:text-base text-center max-w-2xl px-6 mb-10 text-gray-400 relative z-10">
        A complete platform for managing DFCs and ECOs at Yazaki Morocco.
        <br />
        Track, review, and approve technical changes with full traceability.
      </p>

      <div className="hero-stagger-4 flex flex-col items-center gap-5 relative z-10 mb-16">
        <Link href="/login">
          <Button
            type="button"
            variant="gradient"
            size="lg"
            className="rounded-lg flex items-center justify-center gap-2"
            aria-label="Sign in to YECMS"
          >
            Sign in
            <ArrowRight size={16} />
          </Button>
        </Link>
        <p className="text-sm text-gray-400 text-center">
          Don&apos;t have an account?{" "}
          <a href="mailto:admin@yazaki.com" className="text-[#E60012] hover:underline">Contact your administrator: admin@yazaki.com</a>
        </p>
      </div>

      {/* Glow effect */}
      <div className="hero-stagger-5 w-full max-w-5xl relative pb-10">
        <div
          className="absolute left-1/2 w-[70%] h-[200px] pointer-events-none z-0 rounded-full"
          style={{
            top: "-60px",
            transform: "translateX(-50%)",
            background: "radial-gradient(ellipse at center, rgba(230, 0, 18, 0.15) 0%, transparent 70%)",
            filter: "blur(40px)",
            animation: "glowPulse 4s ease-in-out infinite",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 rounded-xl border border-white/10 overflow-hidden shadow-2xl shadow-black/50">
          <img
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=675&fit=crop"
            alt="Dashboard analytics interface preview"
            className="w-full h-auto"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1617] via-transparent to-transparent" />
        </div>
      </div>
    </section>
  );
});

Hero.displayName = "Hero";

// Features Section
const features = [
  {
    icon: FileText,
    title: "DFC Management",
    description: "Create, track, and manage technical change requests with structured workflows and automatic status tracking."
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Secure access control with administrator and user roles. Manage permissions and ensure only authorized staff can take action."
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Real-time statistics and visual charts to track DFC progress, approval rates, and team performance."
  },
  {
    icon: MessageCircle,
    title: "Smart Chatbot",
    description: "An AI assistant connected directly to the DFC database. Ask your question and instantly get accurate answers about technical changes."
  },
  {
    icon: Zap,
    title: "Import PDF & Excel",
    description: "Import DFC data from PDF documents and Excel files, with OCR support for scanned documents."
  },
  {
    icon: Globe,
    title: "Traceability and Collaboration",
    description: "Complete change history and detailed audit logs. Collaborate as a team on requests with transparent tracking."
  }
];

const Features = React.memo(() => {
  return (
    <section id="features" className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <AnimateOnScroll animation="fade-up">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-widest text-[#E60012] font-semibold mb-4 block">
              Features
            </span>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{
                background: "linear-gradient(to bottom, #ffffff, rgba(255, 255, 255, 0.7))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Everything you need to manage changes
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              A complete suite of tools designed for managing technical changes at Yazaki Morocco Meknes.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <AnimateOnScroll
              key={index}
              animation="fade-up"
              delay={0.1 * index}
              duration={0.6}
            >
              <div className="group p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#E60012]/20 transition-all duration-300 h-full">
                <div className="w-10 h-10 rounded-lg bg-[#E60012]/10 flex items-center justify-center mb-4 group-hover:bg-[#E60012]/20 transition-colors">
                  <feature.icon size={20} className="text-[#E60012]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
});

Features.displayName = "Features";

// Workflow Section
const workflowSteps = [
  { step: "01", title: "Create a DFC", description: "Start a new technical change request with all required documentation." },
  { step: "02", title: "Review and Validate", description: "Owners review the request and validate technical specifications." },
  { step: "03", title: "Approve and Execute", description: "Management approves changes and teams execute the technical updates." },
  { step: "04", title: "Track and Report", description: "Monitor progress through dashboards and generate complete reports." },
];

const Workflow = React.memo(() => {
  return (
    <section id="workflow" className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <AnimateOnScroll animation="fade-up">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-widest text-[#E60012] font-semibold mb-4 block">
              Process
            </span>
            <h2
              className="text-3xl md:text-4xl font-bold mb-4"
              style={{
                background: "linear-gradient(to bottom, #ffffff, rgba(255, 255, 255, 0.7))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              A simple and structured process
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Follow a clear 4-step process to manage technical changes from creation to completion.
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {workflowSteps.map((item, index) => (
            <AnimateOnScroll
              key={index}
              animation="fade-right"
              delay={0.15 * index}
              duration={0.6}
            >
              <div className="relative p-6 rounded-xl border border-white/5 bg-white/[0.02] h-full">
                <span className="text-4xl font-bold text-[#E60012]/20 mb-4 block">{item.step}</span>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.description}</p>
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                    <ArrowRight size={16} className="text-[#E60012]/40" />
                  </div>
                )}
              </div>
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
});

Workflow.displayName = "Workflow";

// Stats Section
const stats = [
  { value: "100%", label: "Traceability" },
  { value: "4x", label: "Faster processing" },
  { value: "24/7", label: "Access" },
  { value: "0", label: "Paper waste" },
];

const Stats = React.memo(() => {
  return (
    <section id="stats" className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <AnimateOnScroll animation="scale" duration={0.8}>
          <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#E60012]/5 to-transparent p-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <AnimateOnScroll key={index} animation="fade-up" delay={0.12 * index} duration={0.5}>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-white mb-2">{stat.value}</div>
                    <div className="text-sm text-gray-400">{stat.label}</div>
                  </div>
                </AnimateOnScroll>
              ))}
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
});

Stats.displayName = "Stats";

// Footer Component
const Footer = React.memo(() => {
  return (
    <AnimateOnScroll animation="fade-up" duration={0.6}>
    <footer className="border-t border-white/5 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#E60012] to-[#b8000e] rounded-lg flex items-center justify-center font-bold text-white text-xs">
            Y
          </div>
          <span className="text-sm text-gray-400">YECMS &mdash; Yazaki Morocco Meknes</span>
        </div>
        <p className="text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Yazaki. All rights reserved.
        </p>
      </div>
    </footer>
    </AnimateOnScroll>
  );
});

Footer.displayName = "Footer";

// Main Component
export default function SaaSTemplate() {
  React.useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#1a1617";
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  return (
    <main className="min-h-screen bg-[#1a1617] text-white overflow-x-hidden">
      <Navigation />
      <Hero />
      <Features />
      <Workflow />
      <Stats />
      <Footer />
    </main>
  );
}
