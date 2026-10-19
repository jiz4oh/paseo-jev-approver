/** Client-local notification: mutations trigger an immediate status refresh.
 * Other devices/daemon processes are handled by the periodic RPC fallback.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let epoch = 0;
export function statusEpoch() { return epoch; }
export function invalidateReviewStatus() {
  epoch++;
  for (const listener of [...listeners]) listener();
}
export function subscribeReviewStatus(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
