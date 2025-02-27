import React from 'react';
import { RouteProps } from 'react-router-dom';
import type { UseComponentType } from './ui/use-component';
import { Filters } from './ui/use-component-query';

export type GetComponentsOptions = {
  useComponent?: UseComponentType;
  componentId?: string | (() => string | undefined);
  useComponentFilters?: () => Filters;
  path?: string;
  skipRightSide?: boolean;
  RightNode?: React.ReactNode;
  className?: string;
  routes?: RouteProps[];
};
