export default function LandingScreen({ onStart }) {
  return (
    <div className="landing">
      <img src={`${process.env.PUBLIC_URL}/PeelAwayLogicLogoText.png`} alt="PeelAway Logic" className="landing-logo" />
      <p className="landing-tagline">AI-powered job search pipeline for busy professionals.</p>
      <div className="landing-buttons">
        <button className="btn primary" onClick={onStart}>
          {"\uD83D\uDE80"} Start as Guest
        </button>
      </div>
      <p className="landing-privacy">Your data stays private. No account required to start.</p>
    </div>
  );
}
