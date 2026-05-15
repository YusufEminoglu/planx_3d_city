# -*- coding: utf-8 -*-


def classFactory(iface):
    from .main_plugin import PlanX3DCityPlugin

    return PlanX3DCityPlugin(iface)
