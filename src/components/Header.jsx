export default function Header({ onLogoClick }) {
  const logoImg = (
    <img
      src={`${process.env.PUBLIC_URL}/PeelAwayLogicLogo.png`}
      alt="PeelAway Logic"
      className="header-logo"
      style={onLogoClick ? { cursor: "pointer" } : undefined}
      data-testid="header-logo"
    />
  );
  return (
    <header className="header" data-testid="header">
      {onLogoClick ? (
        <button
          type="button"
          className="header-logo-btn"
          onClick={onLogoClick}
          aria-label="Return to landing screen"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          {logoImg}
        </button>
      ) : (
        logoImg
      )}
      <div>
        <div className="header-brand">PeelAway Logic</div>
        <div className="header-title">Peel away the noise. Surface what matters.</div>
      </div>
    </header>
  );
}
