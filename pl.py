from __future__ import print_function, division
import lldb


class PLUnionProvider(object):

    def __init__(self, valobj:lldb.SBValue, dict={}):
        self.valobj = valobj

    def update(self):
        return True

    def has_children(self):
        return True

    def num_children(self):
        return 1

    def get_child_at_index(self, index):
        # if index > 0:
        #     return None
        tag = self.valobj.GetChildAtIndex(0).GetValueAsUnsigned(0)
        child = self.valobj.GetChildAtIndex(1).GetChildAtIndex(tag)
        return child

    def get_child_index(self, name):
        return 0



def get_summary(valobj:lldb.SBValue,internal_dict,options):
    if "NULL" in valobj.__str__():
        return '<null>'
    s = '{}(Union type)'.format(valobj.type.name.split("::")[1])
    return s


def __lldb_init_module(debugger, dict):
    debugger.HandleCommand('type synthetic add --python-class pl.PLUnionProvider -x union[:<.>,]*')
    debugger.HandleCommand('type summary add  -F pl.get_summary -x union[:<.>,]*')


