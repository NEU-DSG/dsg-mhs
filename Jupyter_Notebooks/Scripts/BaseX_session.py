import sys, os, getpass
from BaseXClient import BaseXClient
import pandas as pd
import numpy as np

from functions_xml_ET_parse import *


"""
Declare global variables.
"""
# Declare regex to simplify file paths below
regex = re.compile(r'.*/\d{4}/(.*)')

# Declare document level of file. Requires root starting point ('.').
doc_as_xpath = './/ns:div/[@type="entry"]'


"""
Main
"""
if __name__ == "__main__":
    if len(sys.argv) != 1:
        print ('Expected command: BaseX-session.py')
        exit(-1)

    usr_login = input("User Login: ")
    usr_pw = getpass.getpass('Password: ')

    session = BaseXClient.Session('dsg.xmldb-dev.northeastern.edu/basex/webdav/psc/mhs/jqa/',
                                  1984, usr_login, usr_pw)


    print (session.info())

    if session:
        session.close()
