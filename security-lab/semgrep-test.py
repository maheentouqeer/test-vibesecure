# VibeSecure security test fixture.
# Intentionally vulnerable and non-production.
# This function is not imported by the application.

def lookup_user(conn, user_id):
    query = "SELECT * FROM users WHERE id = '" + user_id + "'"
    return conn.execute(query).fetchall()
