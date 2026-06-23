import { useState } from 'react';
import { TabBar } from 'home-assistant-react';

const dark = { background: '#111110', padding: '0' };

export function TasksActive() {
  return <div style={dark}><TabBar activeTab="tasks" onSwitch={() => {}} /></div>;
}

export function MealsActive() {
  return <div style={dark}><TabBar activeTab="meals" onSwitch={() => {}} /></div>;
}

export function CalendarActive() {
  return <div style={dark}><TabBar activeTab="calendar" onSwitch={() => {}} /></div>;
}
