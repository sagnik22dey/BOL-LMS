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
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS groups (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE TABLE IF NOT EXISTS group_courses (
		group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
		course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
		PRIMARY KEY (group_id, course_id)
	);

	CREATE TABLE IF NOT EXISTS group_users (
		group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
		user_id UUID REFERENCES users(id) ON DELETE CASCADE,
		PRIMARY KEY (group_id, user_id)
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
	`

	if _, err := Pool.Exec(context.Background(), schema); err != nil {
		log.Fatalf("Schema migration failed: %v", err)
	}
	log.Println("Database schema migrated successfully")
}
