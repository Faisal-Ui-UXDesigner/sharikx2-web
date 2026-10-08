// Android SubscriptionRules.hasActive: active, and either no expiry or not expired.
export function hasActiveSubscription(project, now = Date.now()) {
  const value = project?.subscription_expires_at;
  const expires = typeof value === 'number' ? value : Date.parse(value || '') || 0;
  return project?.subscription_status === 'active' && (expires <= 0 || now < expires);
}
