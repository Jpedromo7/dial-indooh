"use client";

export function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function StrengthBar({ password }: { password: string }) {
  const score = passwordStrength(password);
  const colors = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-amber-400", "bg-emerald-500", "bg-emerald-400"];
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }, (_, index) => (
        <span className={`h-1 flex-1 rounded ${index < score ? colors[score] : "bg-muted"}`} key={index} />
      ))}
    </div>
  );
}
