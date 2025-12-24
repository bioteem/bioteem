"use client"

import { Popover, Transition } from "@headlessui/react"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { Text, clx, useToggleState } from "@medusajs/ui"
import { Fragment } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CountrySelect from "../country-select"
import { HttpTypes } from "@medusajs/types"

const SideMenuItems = {
  Home: "/",
  Store: "/store",
  About: "/about",
  Blog: "/blog",
  FAQs: "/faqs",
  Contact: "/contact",
  Account: "/account",
}

const SideMenu = ({ regions }: { regions: HttpTypes.StoreRegion[] | null }) => {
  const toggleState = useToggleState()

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
            <>
              <div className="relative flex h-full">
                <Popover.Button
                  data-testid="nav-menu-button"
                  className="relative h-full flex items-center transition-all ease-out duration-200 focus:outline-none hover:text-ui-fg-base"
                >
                  Menu
                </Popover.Button>
              </div>

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                {/* FULLSCREEN LAYER (blocks clicks behind) */}
                <Popover.Panel className="fixed inset-0 z-[9999] text-sm">
                  {/* Click-catcher overlay (closes on outside click) */}
                  <button
                    aria-label="Close menu"
                    className="absolute inset-0 bg-black/30 backdrop-blur-2xl"
                    onClick={close}
                  />

                  {/* Drawer */}
                  <div className="absolute left-2 top-2 bottom-2 w-[calc(100%-1rem)] pr-4 sm:pr-0 sm:w-1/3 2xl:w-1/4 sm:min-w-min">
                    <div
                      data-testid="nav-menu-popup"
                      className="flex flex-col h-full bg-[rgba(3,7,18,0.5)] rounded-rounded justify-between p-6 text-ui-fg-on-color"
                    >
                      <div className="flex justify-end" id="xmark">
                        <button
                          data-testid="close-menu-button"
                          onClick={close}
                          className="hover:opacity-80"
                          aria-label="Close"
                        >
                          <XMark />
                        </button>
                      </div>

                      <ul className="flex flex-col gap-6 items-start justify-start">
                        {Object.entries(SideMenuItems).map(([name, href]) => (
                          <li key={name}>
                            <LocalizedClientLink
                              href={href}
                              className="text-3xl leading-10 hover:text-ui-fg-disabled"
                              onClick={close}
                              data-testid={`${name.toLowerCase()}-link`}
                            >
                              {name}
                            </LocalizedClientLink>
                          </li>
                        ))}
                      </ul>

                      <div className="flex flex-col gap-y-6">
                        <div
                          className="flex justify-between"
                          onMouseEnter={toggleState.open}
                          onMouseLeave={toggleState.close}
                        >
                          {regions && (
                            <CountrySelect
                              toggleState={toggleState}
                              regions={regions}
                            />
                          )}
                          <ArrowRightMini
                            className={clx(
                              "transition-transform duration-150",
                              toggleState.state ? "-rotate-90" : ""
                            )}
                          />
                        </div>

                        <Text className="flex justify-between txt-compact-small">
                          © {new Date().getFullYear()} Bioteem40. All rights
                          reserved.
                        </Text>
                      </div>
                    </div>
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
