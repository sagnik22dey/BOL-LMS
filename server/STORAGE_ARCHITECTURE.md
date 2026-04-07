# MinIO Hierarchical Storage Architecture

## Overview

The BOL-LMS platform uses a **single unified MinIO bucket** (`bol-lms`) with a prefix-based hierarchical structure to store all organization-scoped content. This replaces the legacy per-type buckets (`bol-lms-videos`, `bol-lms-documents`) while maintaining full backward compatibility.

## Architecture Decision: Single Bucket with Prefixes

### Why NOT multiple buckets per organization?

| Approach                           | Pros                                                                                            | Cons                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Multiple buckets** (one per org) | Hard isolation                                                                                  | Bucket count grows linearly; harder policy mgmt; MinIO perf degrades with thousands of buckets |
| **Single bucket + prefixes** ✅    | Simple policies; uniform presigned URLs; easy backup/replication; scales to millions of objects | Slightly more complex key management (handled by helper functions)                             |

**Decision:** Single bucket with hierarchical key prefixes — the MinIO best practice for multi-tenant applications.

## Directory Structure

```
bol-lms/                              ← unified bucket
├── org-alpha/                        ← org slug prefix
│   ├── private/                      ← private courses
│   │   ├── <course-uuid>/
│   │   │   ├── videos/
│   │   │   │   ├── lecture-1.mp4
│   │   │   │   └── lecture-2.mp4
│   │   │   ├── docs/
│   │   │   │   ├── syllabus.pdf
│   │   │   │   └── slides-week1.pptx
│   │   │   └── assignments/
│   │   │       ├── <student-uuid-1>/
│   │   │       │   ├── hw1.pdf
│   │   │       │   └── hw2.pdf
│   │   │       └── <student-uuid-2>/
│   │   │           └── hw1.pdf
│   │   └── <another-course-uuid>/
│   │       ├── videos/
│   │       ├── docs/
│   │       └── assignments/
│   └── public/                       ← public courses
│       └── <course-uuid>/
│           ├── videos/
│           ├── docs/
│           └── assignments/
├── org-beta/
│   ├── private/
│   └── public/
```

## Access Control Model

### Application-Layer Enforcement (Primary)

Access control is enforced **at the application layer** via presigned URL generation. Only the server can generate presigned URLs, and the middleware gates who can request them:

| Content Type   | Who Can Upload | Enforced By                                                                                 |
| -------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `videos/`      | Admins only    | `RequireRole(admin)` middleware on `/api/courses/h-presign`                                 |
| `docs/`        | Admins only    | `RequireRole(admin)` middleware on `/api/courses/h-presign`                                 |
| `assignments/` | Students only  | Auth middleware on `/api/learning/h-presign-put`; key scoped to `assignments/{student-id}/` |

### Bucket-Level Policy (Defense-in-Depth)

A bucket policy enables **anonymous read access** for public course content:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead-org-alpha",
      "Effect": "Allow",
      "Principal": { "AWS": "*" },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::bol-lms/org-alpha/public/*"]
    }
  ]
}
```

This policy is automatically set when an organization is created.

### Student Isolation

Students can only:

1. **Upload** to their own `assignments/{student-id}/` prefix (server generates the key)
2. **View** their own submissions via `GET /api/learning/courses/:id/my-assignments`
3. **Cannot** see other students' submissions (the listing is scoped to their UUID)

## API Endpoints

### Admin Endpoints (require `admin` role)

| Method | Path                                                      | Description                                     |
| ------ | --------------------------------------------------------- | ----------------------------------------------- |
| `POST` | `/api/courses/h-presign`                                  | Generate presigned PUT URL for video/doc upload |
| `GET`  | `/api/courses/:id/content?type=videos\|docs\|assignments` | List objects in a course directory              |

#### Request: `POST /api/courses/h-presign`

```json
{
  "course_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "videos",
  "filename": "lecture-1.mp4",
  "expiry_mins": 60
}
```

#### Response:

```json
{
  "url": "https://minio.example.com/bol-lms/org-alpha/private/550e8400.../videos/lecture-1.mp4?X-Amz-...",
  "object_key": "org-alpha/private/550e8400-e29b-41d4-a716-446655440000/videos/lecture-1.mp4",
  "bucket": "bol-lms"
}
```

### Student Endpoints (require authentication)

| Method | Path                                         | Description                                      |
| ------ | -------------------------------------------- | ------------------------------------------------ |
| `POST` | `/api/learning/h-presign-put`                | Generate presigned PUT URL for assignment upload |
| `GET`  | `/api/learning/h-presign-get?object_key=...` | Generate presigned GET URL for any object        |
| `GET`  | `/api/learning/courses/:id/my-assignments`   | List student's own assignment files              |

#### Request: `POST /api/learning/h-presign-put`

```json
{
  "course_id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "assignments",
  "filename": "homework-1.pdf",
  "expiry_mins": 15
}
```

## Configuration

Add to your `.env`:

```env
# Unified hierarchical LMS bucket
MINIO_BUCKET_LMS=bol-lms
```

The legacy buckets (`MINIO_BUCKET_VIDEOS`, `MINIO_BUCKET_DOCS`) remain functional for backward compatibility with existing content. New uploads should use the hierarchical endpoints.

## Lifecycle Hooks

The hierarchy is automatically managed at key lifecycle events:

| Event                         | Action                                                                                           | File                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **Server startup**            | Creates `bol-lms` bucket if missing                                                              | `storage/minio.go` → `Connect()`                                            |
| **Org created**               | Creates `{slug}/private/.keep` and `{slug}/public/.keep` markers; sets public-read bucket policy | `handlers/organization.go` → `CreateOrganization()`                         |
| **Course created**            | Creates `videos/.keep`, `docs/.keep`, `assignments/.keep` under course prefix                    | `handlers/course.go` → `CreateCourse()`                                     |
| **Student uploads**           | Creates `assignments/{student-id}/.keep` directory marker on first upload                        | `handlers/storage_hierarchy.go` → `GenerateStudentHierarchicalPresignPut()` |
| **Course visibility changed** | Moves all objects from `private/` to `public/` or vice versa                                     | `handlers/course.go` → `UpdateCourse()`                                     |
| **Course deleted**            | Removes all objects under the course prefix                                                      | `handlers/course.go` → `DeleteCourse()`                                     |

## Code Organization

| File                                                                                      | Purpose                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`server/internal/storage/hierarchy.go`](internal/storage/hierarchy.go)                   | Path builders, hierarchy init, bucket policies, list/delete helpers |
| [`server/internal/storage/minio.go`](internal/storage/minio.go)                           | MinIO client, connection, presigned URL generation                  |
| [`server/internal/handlers/storage_hierarchy.go`](internal/handlers/storage_hierarchy.go) | HTTP handlers for hierarchical presign, content listing             |
| [`server/config/config.go`](config/config.go)                                             | `MinioBucketLMS` configuration                                      |

## Key Functions Reference

### Path Builders (pure, no I/O)

```go
storage.OrgPrefix("org-alpha")
// → "org-alpha/"

storage.CoursePrefix("org-alpha", storage.VisibilityPrivate, "course-uuid")
// → "org-alpha/private/course-uuid/"

storage.ContentPrefix("org-alpha", storage.VisibilityPrivate, "course-uuid", storage.ContentTypeVideos)
// → "org-alpha/private/course-uuid/videos/"

storage.StudentAssignmentPrefix("org-alpha", storage.VisibilityPrivate, "course-uuid", "student-uuid")
// → "org-alpha/private/course-uuid/assignments/student-uuid/"

storage.VideoObjectKey("org-alpha", storage.VisibilityPrivate, "course-uuid", "lecture.mp4")
// → "org-alpha/private/course-uuid/videos/lecture.mp4"

storage.AssignmentObjectKey("org-alpha", storage.VisibilityPrivate, "course-uuid", "student-uuid", "hw1.pdf")
// → "org-alpha/private/course-uuid/assignments/student-uuid/hw1.pdf"
```

### Hierarchy Initialization

```go
storage.InitOrgHierarchy(ctx, "org-alpha")
storage.InitCourseHierarchy(ctx, "org-alpha", storage.VisibilityPrivate, "course-uuid")
storage.InitStudentAssignmentDir(ctx, "org-alpha", storage.VisibilityPrivate, "course-uuid", "student-uuid")
```

### Presigned URLs

```go
url, err := storage.HierarchicalPresignPut("org-alpha/private/course-uuid/videos/lecture.mp4", 60*time.Minute)
url, err := storage.HierarchicalPresignGet("org-alpha/private/course-uuid/docs/syllabus.pdf", 60*time.Minute)
```

## Scalability

- **Organizations:** Each org is a top-level prefix — unlimited orgs supported
- **Courses per org:** Each course is a UUID-based prefix — unlimited courses
- **Students per course:** Each student gets a UUID prefix under `assignments/` — unlimited students
- **Objects:** MinIO handles billions of objects in a single bucket efficiently with its erasure-coding backend
- **Listing performance:** Prefix-based listing (via `ListObjects` with prefix filter) is O(matching objects), not O(total objects)
