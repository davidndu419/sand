-- Keep the donor amount selector and its administrator editor to three choices.

update public.support_categories
set suggested_amounts_minor = (suggested_amounts_minor)[1:3]
where coalesce(array_length(suggested_amounts_minor, 1), 0) > 3;
