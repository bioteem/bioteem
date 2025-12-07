// src/modules/subscription/index.ts
import { Module } from "@medusajs/framework/utils"
import SubscriptionModuleService from "./service"

export const SUBSCRIPTION_MODULE = "subscription" // <- module key

export default Module(SUBSCRIPTION_MODULE, {
  service: SubscriptionModuleService,
})