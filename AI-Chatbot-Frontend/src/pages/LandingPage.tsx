import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { ChatPreview } from '@/components/landing/ChatPreview';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { HeroSection } from '@/components/landing/HeroSection';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <HeroSection />
      <ChatPreview />
      <FeatureGrid />

      <section className="container text-center landing-cta-section" aria-labelledby="landing-cta-title">
        <h2 id="landing-cta-title" style={{ fontSize: 26, marginBottom: 10 }}>
          Ready to try it?
        </h2>
        <p className="text-muted" style={{ marginBottom: 20 }}>
          Create a free account in under a minute.
        </p>
        <Button size="lg" className="btn-pill btn-glow" onClick={() => navigate('/register')}>
          Get started
        </Button>
      </section>
    </div>
  );
}
