package db

import (
	"context"
	"log"

	"bol-lms-server/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func Connect() {
	pool, err := pgxpool.New(context.Background(), config.App.PostgresDSN)
	if err != nil {
		log.Fatalf("PostgreSQL connection error: %v", err)
	}
	if err = pool.Ping(context.Background()); err != nil {
		log.Fatalf("PostgreSQL ping error: %v", err)
	}
	Pool = pool
	log.Println("PostgreSQL connected successfully")
	migrate()
}

func migrate() {
	schema := `
	CREATE EXTENSION IF NOT EXISTS "pgcrypto";

	CREATE TABLE IF NOT EXISTS organizations (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		name TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS users (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'user',
		organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
		is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS organization_admins (
		organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		PRIMARY KEY (organization_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS courses (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		thumbnail_key TEXT NOT NULL DEFAULT '',
		modules JSONB NOT NULL DEFAULT '[]',
		is_published BOOLEAN NOT NULL DEFAULT FALSE,
		is_public BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	DROP TABLE IF EXISTS group_users, group_courses, groups CASCADE;

	CREATE TABLE IF NOT EXISTS course_bundles (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS course_bundle_courses (
		bundle_id UUID REFERENCES course_bundles(id) ON DELETE CASCADE,
		course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
		PRIMARY KEY (bundle_id, course_id)
	);

	CREATE TABLE IF NOT EXISTS course_bundle_users (
		bundle_id UUID REFERENCES course_bundles(id) ON DELETE CASCADE,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		PRIMARY KEY (bundle_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS enrollments (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
		progress DOUBLE PRECISION NOT NULL DEFAULT 0,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE(user_id, course_id)
	);

	CREATE TABLE IF NOT EXISTS assignments (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
		module_id UUID NOT NULL,
		organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		deadline TIMESTAMPTZ,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS assignment_submissions (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
		module_id UUID NOT NULL,
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		file_path TEXT NOT NULL,
		submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		retake_allowed BOOLEAN NOT NULL DEFAULT FALSE,
		UNIQUE(assignment_id, user_id)
	);

	CREATE TABLE IF NOT EXISTS quizzes (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
		module_id UUID NOT NULL,
		organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		time_limit_mins INT NOT NULL DEFAULT 0,
		questions JSONB NOT NULL DEFAULT '[]',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS submissions (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
		module_id UUID NOT NULL,
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		answers JSONB NOT NULL DEFAULT '[]',
		score INT NOT NULL DEFAULT 0,
		max_score INT NOT NULL DEFAULT 0,
		is_graded BOOLEAN NOT NULL DEFAULT FALSE,
		graded_by UUID REFERENCES users(id),
		started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		submitted_at TIMESTAMPTZ,
		retake_allowed BOOLEAN NOT NULL DEFAULT FALSE
	);

	CREATE TABLE IF NOT EXISTS notifications (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		title TEXT NOT NULL,
		message TEXT NOT NULL,
		type TEXT NOT NULL,
		organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
		created_by UUID NOT NULL REFERENCES users(id),
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS comments (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		module_id UUID NOT NULL,
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		user_name TEXT NOT NULL,
		text TEXT NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS user_course_assignments (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
		assigned_by UUID NOT NULL REFERENCES users(id),
		assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE(user_id, course_id)
	);
	CREATE TABLE IF NOT EXISTS carts (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE(user_id)
	);

	CREATE TABLE IF NOT EXISTS cart_items (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
		item_type TEXT NOT NULL, 
		item_id UUID NOT NULL,
		added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		UNIQUE(cart_id, item_type, item_id)
	);

	CREATE TABLE IF NOT EXISTS orders (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		total_amount INTEGER NOT NULL DEFAULT 0,
		currency TEXT NOT NULL DEFAULT 'INR',
		status TEXT NOT NULL DEFAULT 'pending', 
		payment_id TEXT, 
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS order_items (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
		item_type TEXT NOT NULL, 
		item_id UUID NOT NULL,
		price INTEGER NOT NULL DEFAULT 0,
		currency TEXT NOT NULL DEFAULT 'INR',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	`

	if _, err := Pool.Exec(context.Background(), schema); err != nil {
		log.Fatalf("Schema migration failed: %v", err)
	}

	// Safely add new columns to existing deployments
	alterSchema := `
	ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
	ALTER TABLE courses ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0;
	ALTER TABLE courses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
	ALTER TABLE courses ADD COLUMN IF NOT EXISTS validity_days INTEGER;

	ALTER TABLE course_bundles ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0;
	ALTER TABLE course_bundles ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
	ALTER TABLE course_bundles ADD COLUMN IF NOT EXISTS validity_days INTEGER;

	ALTER TABLE user_course_assignments ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
	ALTER TABLE course_bundle_users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

	ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_name TEXT NOT NULL DEFAULT '';
	ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_bio TEXT NOT NULL DEFAULT '';
	`
	if _, err := Pool.Exec(context.Background(), alterSchema); err != nil {
		log.Fatalf("Alter schema failed: %v", err)
	}

	log.Println("Database schema migrated successfully")
}
