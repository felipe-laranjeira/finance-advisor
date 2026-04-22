-- Force activate existing users and ensure the system is unblocked
-- This is a recovery migration
UPDATE public.users 
SET status = 'Active' 
WHERE status = 'Inactive';

-- Ensure felipededeus@gmail.com is active if they registered with case differences
UPDATE public.users
SET email = LOWER(email), status = 'Active'
WHERE LOWER(email) = 'felipededeus@gmail.com';
