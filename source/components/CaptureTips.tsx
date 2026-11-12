// Photo tips shown on the capture step — a clear photo is the single
// biggest factor in a good reading, so the advice lives where the
// photo is taken, not buried in help text.
export default function CaptureTips() {
  return (
    <div className="capture-tips">
      <h3>Tips for a clear photo</h3>
      <ul>
        <li>
          <b>Front camera coming out soft?</b> Have a friend take the photo with the{" "}
          <b>rear camera</b> instead — it's sharper, and its light switches on to help.
        </li>
        <li>
          <b>Try a magnifying glass</b> held just in front of the lens — it works like a
          macro lens and brings out finer detail in the iris.
        </li>
        <li>
          <b>Face a window</b> or another bright, even light, so the whole iris is lit
          with no shadows across it.
        </li>
        <li>
          <b>Fill the guide circle</b> — hold the phone about 10–15&nbsp;cm (4–6 inches)
          from the eye and keep it steady. The app captures several frames and keeps
          the sharpest.
        </li>
        <li>
          <b>Eye wide open,</b> looking straight at the lens, with lids and lashes clear
          of the iris — and glasses off.
        </li>
        <li>
          <b>Wipe the lens first</b> — a smudged lens softens everything.
        </li>
      </ul>
    </div>
  );
}
