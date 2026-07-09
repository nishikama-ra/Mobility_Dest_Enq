function testGetPublicNeedsLog() {
  const t0 = Date.now();
  const items = getPublicNeeds_();
  console.log('[test] items=' + items.length + ', total=' + (Date.now() - t0) + 'ms');
}
