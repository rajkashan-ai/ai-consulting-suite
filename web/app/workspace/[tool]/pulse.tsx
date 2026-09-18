/**
 * An agent is working, and this is the only way the product says so.
 *
 * WHY IT REPLACES SPINNERS AND SKELETONS
 * A spinner says "something is happening" and nothing else, so a stalled run
 * and a working one look identical for as long as anyone is willing to watch.
 * A skeleton is worse: it draws a shape that is not there yet, which is a
 * promise about an answer nobody has.
 *
 * This says what the agent is doing, in a sentence, beside a dot that is lit
 * because the dot means one thing only: an agent is running right now. Charge
 * lime never marks data anywhere in this product.
 *
 * NO PERCENTAGE, EVER
 * We do not know what fraction of the work is left. A made-up percentage is a
 * lie people sit and watch, and the run that produced this rule took six and a
 * half minutes with no way to know that in advance.
 */
export default function AgentPulse({
  doing,
  /** Faster while a step is actually in flight, so waiting and working differ. */
  busy = false,
}: {
  doing: string;
  busy?: boolean;
}) {
  return (
    <p className={`pulse${busy ? " pulse--busy" : ""}`} role="status">
      <span className="pulse__dot" aria-hidden="true" />
      <span className="pulse__say">{doing}</span>
    </p>
  );
}
