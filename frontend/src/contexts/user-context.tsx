"use client";

import React, { createContext, useContext, useState } from "react";

export type User = {
  id: string;
  email: string | null;
  name: string | null;
  is_guest: boolean;
};

type UserContextProps = {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
};

const UserContext = createContext<UserContextProps | null>(null);

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider.");
  }
  return context;
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}
