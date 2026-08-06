import type { IconType } from 'react-icons';
import { FaBolt, FaComments, FaSearch, FaShieldAlt } from 'react-icons/fa';

interface Feature {
  icon: IconType;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: FaSearch,
    title: 'Instant answers',
    description: 'Search your uploaded notices and get grounded answers with sources, in seconds.',
  },
  {
    icon: FaBolt,
    title: 'Streaming responses',
    description: 'Watch answers appear token-by-token, just like ChatGPT — no waiting for full loads.',
  },
  {
    icon: FaComments,
    title: 'Conversation history',
    description: 'Chats are saved, searchable, shareable and exportable. Pick up where you left off.',
  },
  {
    icon: FaShieldAlt,
    title: 'Secure accounts',
    description: 'JWT-based authentication with refresh rotation, quota controls and role-based access.',
  },
];

export function FeatureGrid() {
  return (
    <section className="container" aria-labelledby="landing-features-title" style={{ padding: '104px 24px 32px' }}>
      <h2 id="landing-features-title" className="section-title">
        Built for campus, powered by AI
      </h2>
      <p className="section-subtitle">
        Everything you need to find what matters in your university notices — in one place.
      </p>
      <div className="feature-grid">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="card card-pad hover-lift">
            <div className="feature-icon">
              <feature.icon />
            </div>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>{feature.title}</h3>
            <p className="text-sm text-secondary" style={{ margin: 0 }}>
              {feature.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
