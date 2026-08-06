import { useNavigate } from 'react-router-dom';
import { MdArrowForward } from 'react-icons/md';
import { Button } from '@/components/ui/Button';
import { BackgroundFX } from './BackgroundFX';

const BADGES = ['AI Powered', 'Verified Sources', 'Instant Answers', 'Secure & Reliable'];

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="landing-hero" aria-labelledby="landing-hero-title">
      <BackgroundFX />
      <div className="container hero-inner">
        <span className="hero-eyebrow fade-in-up">AI-powered campus assistant</span>
        <h1 id="landing-hero-title" className="hero-title fade-in-up" style={{ animationDelay: '0.08s' }}>
          The smartest way to search
          <br />
          your <span className="gradient-text">campus notices</span>
        </h1>
        <p className="hero-subtitle fade-in-up" style={{ animationDelay: '0.16s' }}>
          Get instant AI-powered answers from uploaded university notices, exam routines, admission
          circulars, fees, scholarships, and more—with verified sources.
        </p>
        <div className="hero-cta-row fade-in-up" style={{ animationDelay: '0.24s' }}>
          <Button size="lg" className="btn-pill btn-glow" onClick={() => navigate('/register')}>
            Start Chatting Free <MdArrowForward className="btn-arrow-icon" />
          </Button>
          <Button size="lg" variant="outline" className="btn-pill" onClick={() => navigate('/login')}>
            Log In
          </Button>
        </div>
        <ul className="feature-badges fade-in-up" style={{ animationDelay: '0.32s' }}>
          {BADGES.map((label) => (
            <li className="feature-badge" key={label}>
              <span className="badge-check" aria-hidden="true">
                ✓
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
