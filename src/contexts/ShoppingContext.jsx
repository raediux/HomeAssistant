import { createContext, useContext } from 'react';
import { useShoppingData } from '../hooks/useShoppingData.js';

const ShoppingContext = createContext(null);

export function ShoppingProvider({ children }) {
  const shopData = useShoppingData();
  return <ShoppingContext.Provider value={shopData}>{children}</ShoppingContext.Provider>;
}

export function useShop() {
  return useContext(ShoppingContext);
}
