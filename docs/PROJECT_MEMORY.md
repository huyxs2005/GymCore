# GymCore Project Memory (Working Notes)

Purpose: quick context snapshot so future work can resume without re-discovering decisions.

## 1) Tech stack and structure
- Backend: Spring Boot REST API (no Thymeleaf server-rendered pages).
- Frontend: React + Vite.
- Project folders: `backend/`, `frontend/`, `docs/`.

## 2) Auth + session decisions
- Login methods:
  - Email/password.
  - Google login for CUSTOMER / COACH / RECEPTIONIST.
  - ADMIN login is email/password only.
- Passwords are stored hashed (bcrypt) in DB.
- JWT approach:
  - Short-lived access token.
  - Longer-lived refresh token in HttpOnly cookie.
- OTP policy:
  - OTP expiry: 2 minutes.
  - Resend cooldown: 5 seconds.
  - Resend invalidates previous OTP.

## 3) Profile / account UI decisions
- Header account menu shows logged-in user identity.
- Profile page supports:
  - View/edit full name and phone.
  - Avatar upload + crop flow.
  - Change password.
- DOB/Gender visibility:
  - Visible/editable for CUSTOMER and COACH only.
  - Hidden for ADMIN and RECEPTIONIST.
- QR code:
  - Only CUSTOMER sees QR menu item/dialog (for check-in flow).

## 4) Forgot password flow
- Updated to 2-step UX:
  1. Request OTP + verify OTP on `/auth/forgot-password`.
  2. Redirect to `/auth/forgot-password/reset` after successful OTP verification.
- New password fields are only on reset page, not before OTP verification.

## 5) Email sending
- Auth mail service upgraded to multipart email (plain + HTML) with professional templates.
- HTML content is inline-styled (normal for email clients).
- Secrets (mail account/password) are env-based, not hardcoded in source.

## 6) Database status (docs)
- `docs/GymCore.txt` updated with:
  - Existing full gym schema.
  - Added AI-related structured tables:
    - `FitnessGoals`, `CustomerGoals`
    - `MealCategories`, `Meals`, `MealCategoryMap`
    - `FoodGoalMap`, `MealGoalMap`, `WorkoutGoalMap`
    - `Allergens`, `CustomerAllergies`, `FoodAllergenMap`, `MealAllergenMap`
- Foods are kept; Meals were added (both exist).
- Allergy handling direction: strict block in recommendation logic (do not parse recipe free text).

## 7) Seed data status
- `docs/InsertValues.txt` updated and idempotent:
  - Roles/users/profiles/time slots/membership/plans/products/cart/promotions/PT sample data.
  - Bcrypt hashes for seeded accounts.
  - Added goal/meal/allergen sample seed data and mappings.
- Seeded login passwords:
  - Admin: `Admin123456!`
  - Receptionist: `Reception123456!`
  - Coach: `Coach123456!`
  - Customer: `Customer123456!`

## 8) Env file convention for teammates
- Real local env files are gitignored.
- Templates committed:
  - `backend/.env.example`  -> copy to `backend/.env`
  - `frontend/.env.example` -> copy to `frontend/.env.local`
- Team members must fill their own local values (JWT secret, Google client IDs, mail creds, etc.).

## 9) Content/AI API scaffolding
- `ContentController` includes placeholder endpoints for:
  - meals/categories/goals/allergens
  - AI recommendations
- Current implementation is barebones placeholder responses; business logic still to implement.

## 10) Test status pattern
- Backend tests run with Maven wrapper.
- Frontend tests run with Vitest (`npm run test:run`).
- Recent state after major changes was green on both sides.

## 11) Working principle reminders
- Keep secrets out of git.
- Use env templates for onboarding.
- Keep SQL seed scripts idempotent.
- Prefer structured mapping tables over free-text parsing for filtering.

