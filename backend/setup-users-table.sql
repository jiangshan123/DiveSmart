-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Add comments
COMMENT ON TABLE users IS 'User account table';

COMMENT ON COLUMN users.id IS 'User ID';

COMMENT ON COLUMN users.email IS 'User email (unique)';

COMMENT ON COLUMN users.password IS 'Encrypted password';

COMMENT ON COLUMN users.username IS 'Username';

COMMENT ON COLUMN users.created_at IS 'Account creation time';

COMMENT ON COLUMN users.last_login IS 'Last login time';

COMMENT ON COLUMN users.updated_at IS 'Update time';