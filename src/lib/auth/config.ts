/**
 * Deliberately short so token expiry is exercised during normal use/testing, per the
 * brief. A real deployment would drop this override and rely on the API's default
 * (or a much longer, product-decided lifetime) -- the refresh-and-retry machinery
 * behaves identically either way, since it reacts to whatever `exp` it's handed.
 */
export const ACCESS_TOKEN_LIFETIME_MINS = 1;
